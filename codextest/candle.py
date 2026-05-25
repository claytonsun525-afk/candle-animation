from __future__ import annotations

import math
import random
import time
import tkinter as tk


def _clamp(value: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, value))


def _hex_to_rgb(color: str) -> tuple[int, int, int]:
    color = color.lstrip("#")
    return int(color[0:2], 16), int(color[2:4], 16), int(color[4:6], 16)


def _rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    r, g, b = rgb
    return f"#{r:02x}{g:02x}{b:02x}"


def _mix(a: str, b: str, t: float) -> str:
    t = _clamp(t, 0.0, 1.0)
    ar, ag, ab = _hex_to_rgb(a)
    br, bg, bb = _hex_to_rgb(b)
    return _rgb_to_hex(
        (
            int(ar + (br - ar) * t),
            int(ag + (bg - ag) * t),
            int(ab + (bb - ab) * t),
        )
    )


class CandleApp:
    def __init__(self) -> None:
        self.width = 900
        self.height = 560

        self.root = tk.Tk()
        self.root.title("灵动蜡烛 (tkinter)")
        self.root.resizable(False, False)

        self.canvas = tk.Canvas(
            self.root,
            width=self.width,
            height=self.height,
            bg="#070a12",
            highlightthickness=0,
        )
        self.canvas.pack()

        self.cx = self.width // 2
        self.floor_y = self.height - 70

        self.candle_w = 170
        self.candle_h0 = 290
        self.candle_melt_px = 0.0

        self.wick_len = 26
        self.t0 = time.perf_counter()

        self._last_drip_spawn = 0.0
        self.drips: list[dict[str, float]] = []

        self._frame()

    def run(self) -> None:
        self.root.mainloop()

    def _draw_background(self, tsec: float) -> None:
        # soft vignette glow around the flame
        glow_center_y = self.floor_y - (self.candle_h0 - self.candle_melt_px) - 35
        for i in range(14):
            r = 40 + i * 18
            a = 1.0 - i / 14
            color = _mix("#070a12", "#1a2545", a * 0.75)
            self.canvas.create_oval(
                self.cx - r,
                glow_center_y - r,
                self.cx + r,
                glow_center_y + r,
                outline="",
                fill=color,
            )

        # subtle stars
        random.seed(7)
        for _ in range(85):
            x = random.randint(0, self.width)
            y = random.randint(0, 230)
            tw = 0.2 + 0.8 * (0.5 + 0.5 * math.sin(tsec * 1.4 + x * 0.02 + y * 0.03))
            if tw < 0.65:
                continue
            c = _mix("#070a12", "#a9c6ff", (tw - 0.65) / 0.35)
            self.canvas.create_oval(x, y, x + 2, y + 2, outline="", fill=c)

    def _draw_candle(self) -> tuple[float, float]:
        candle_h = max(140, self.candle_h0 - self.candle_melt_px)
        x0 = self.cx - self.candle_w / 2
        x1 = self.cx + self.candle_w / 2
        y1 = self.floor_y
        y0 = y1 - candle_h

        # base shadow
        self.canvas.create_oval(
            x0 - 60,
            y1 - 12,
            x1 + 60,
            y1 + 18,
            outline="",
            fill="#05060b",
        )

        # candle gradient body
        left = "#f7f0e6"
        mid = "#fffaf2"
        right = "#e7ddcf"
        stripes = 36
        for i in range(stripes):
            t = i / (stripes - 1)
            color = _mix(left, mid, _clamp(1.8 * (1 - abs(2 * t - 1)), 0.0, 1.0))
            color = _mix(color, right, _clamp((t - 0.6) / 0.4, 0.0, 1.0) * 0.6)
            sx0 = x0 + (x1 - x0) * (i / stripes)
            sx1 = x0 + (x1 - x0) * ((i + 1) / stripes)
            self.canvas.create_rectangle(sx0, y0, sx1, y1, outline="", fill=color)

        # rounded top
        self.canvas.create_oval(
            x0,
            y0 - 48,
            x1,
            y0 + 48,
            outline="",
            fill="#fbf4ea",
        )
        # inner melt pool
        self.canvas.create_oval(
            x0 + 26,
            y0 - 18,
            x1 - 26,
            y0 + 26,
            outline="",
            fill="#efe4d6",
        )

        # lip highlight
        self.canvas.create_arc(
            x0 + 18,
            y0 - 34,
            x1 - 18,
            y0 + 34,
            start=15,
            extent=150,
            style=tk.ARC,
            width=3,
            outline="#ffffff",
        )

        return y0, candle_h

    def _draw_wick(self, y0: float) -> tuple[float, float]:
        base_x = self.cx
        base_y = y0 + 6
        tip_x = base_x + 2
        tip_y = base_y - self.wick_len

        self.canvas.create_line(
            base_x,
            base_y,
            tip_x,
            tip_y,
            fill="#2a1a12",
            width=4,
            capstyle=tk.ROUND,
        )
        self.canvas.create_line(
            base_x,
            base_y,
            tip_x,
            tip_y,
            fill="#3a261a",
            width=2,
            capstyle=tk.ROUND,
        )
        return tip_x, tip_y

    def _flame_polygon(self, x: float, y: float, h: float, w: float, sway: float, squish: float) -> list[float]:
        # build a smooth-ish flame outline using a parametric curve
        pts: list[float] = []
        steps = 28

        for i in range(steps + 1):
            u = i / steps  # 0..1 bottom->top
            # width profile: fat at bottom, thin at top
            profile = (1 - u) ** 0.55
            # asymmetry + wobble
            wob = math.sin(u * math.pi * 1.1 + sway) * (0.35 + 0.25 * (1 - u))
            half = (w * profile) * (0.85 + 0.15 * math.cos(u * math.pi * 2.0 + sway))
            half *= (1.0 - 0.22 * u * squish)

            px = x + (wob * half) + (sway * 0.6) * (1 - u)
            py = y - h * u
            pts.append(px + half)
            pts.append(py)

        for i in range(steps, -1, -1):
            u = i / steps
            profile = (1 - u) ** 0.55
            wob = math.sin(u * math.pi * 1.1 + sway) * (0.35 + 0.25 * (1 - u))
            half = (w * profile) * (0.85 + 0.15 * math.cos(u * math.pi * 2.0 + sway))
            half *= (1.0 - 0.22 * u * squish)

            px = x + (wob * half) + (sway * 0.6) * (1 - u)
            py = y - h * u
            pts.append(px - half)
            pts.append(py)

        return pts

    def _draw_flame(self, tx: float, ty: float, tsec: float) -> None:
        # organic flicker
        sway = math.sin(tsec * 7.0) * 4.0 + math.sin(tsec * 2.7) * 2.0
        breathe = 0.5 + 0.5 * math.sin(tsec * 3.2 + 1.1)
        squish = 0.5 + 0.5 * math.sin(tsec * 5.1 + 0.8)

        base_x = tx + sway * 0.35
        base_y = ty - 6 + math.sin(tsec * 6.6) * 1.4

        outer_h = 92 + 12 * breathe
        outer_w = 34 + 6 * (1 - breathe)
        inner_h = outer_h * 0.72
        inner_w = outer_w * 0.55

        # far glow
        for i in range(10):
            a = 1.0 - i / 10
            r = 18 + i * 9
            color = _mix("#070a12", "#2b56ff", a * 0.22)
            self.canvas.create_oval(
                base_x - r,
                base_y - r - 18,
                base_x + r,
                base_y + r + 18,
                outline="",
                fill=color,
            )

        # outer flame
        outer_pts = self._flame_polygon(base_x, base_y, outer_h, outer_w, sway=tsec * 2.4, squish=squish)
        self.canvas.create_polygon(outer_pts, outline="", fill="#ff7a2f", smooth=True)

        # mid layer
        mid_pts = self._flame_polygon(base_x, base_y + 2, outer_h * 0.86, outer_w * 0.78, sway=tsec * 2.7 + 1.2, squish=squish)
        self.canvas.create_polygon(mid_pts, outline="", fill="#ffb347", smooth=True)

        # inner core
        inner_pts = self._flame_polygon(base_x, base_y + 6, inner_h, inner_w, sway=tsec * 3.0 + 2.1, squish=squish)
        self.canvas.create_polygon(inner_pts, outline="", fill="#ffe9a6", smooth=True)

        # hottest tip sparkle
        tip_x = base_x + math.sin(tsec * 9.0) * 2.0
        tip_y = base_y - outer_h + 10
        self.canvas.create_oval(tip_x - 4, tip_y - 4, tip_x + 4, tip_y + 4, outline="", fill="#fff6cf")

    def _spawn_drip(self, tsec: float, y0: float) -> None:
        if tsec - self._last_drip_spawn < 0.9 + random.random() * 1.6:
            return
        self._last_drip_spawn = tsec
        x = self.cx + random.uniform(-self.candle_w * 0.26, self.candle_w * 0.26)
        self.drips.append(
            {
                "x": x,
                "y": y0 + random.uniform(10, 28),
                "v": random.uniform(28, 46),
                "r": random.uniform(3.0, 5.5),
            }
        )

    def _draw_drips(self, dt: float, y0: float, y1: float) -> None:
        alive: list[dict[str, float]] = []
        for d in self.drips:
            d["y"] += d["v"] * dt
            d["v"] += 42 * dt
            if d["y"] > y1 - 6:
                continue
            alive.append(d)

            r = d["r"]
            # slightly translucent look by mixing with background
            color = _mix("#070a12", "#f3e6d6", 0.82)
            self.canvas.create_oval(d["x"] - r, d["y"] - r, d["x"] + r, d["y"] + r, outline="", fill=color)
            self.canvas.create_oval(d["x"] - r * 0.45, d["y"] - r * 0.6, d["x"] + r * 0.45, d["y"] + r * 0.2, outline="", fill="#ffffff")
        self.drips = alive

    def _frame(self) -> None:
        now = time.perf_counter()
        tsec = now - self.t0

        # melt very slowly
        self.candle_melt_px = min(self.candle_h0 - 160, tsec * 0.8)

        # spawn occasional wax drips
        self.canvas.delete("all")

        self._draw_background(tsec)
        y0, candle_h = self._draw_candle()
        wick_tip_x, wick_tip_y = self._draw_wick(y0)

        self._spawn_drip(tsec, y0)
        self._draw_drips(1 / 60, y0, self.floor_y)

        self._draw_flame(wick_tip_x, wick_tip_y, tsec)

        # ground
        self.canvas.create_rectangle(0, self.floor_y, self.width, self.height, outline="", fill="#060812")

        self.root.after(16, self._frame)


def main() -> None:
    CandleApp().run()


if __name__ == "__main__":
    main()
