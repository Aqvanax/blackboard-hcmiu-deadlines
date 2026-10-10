#!/usr/bin/env python3
# Sinh icon extension (lịch bo góc + chấm đỏ deadline) và tile khuyến mãi store.
# Chạy: python3 store/make-icons.py  (cần Pillow, chỉ để tạo asset tĩnh một lần).
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..")
ICONS = os.path.join(ROOT, "extension", "icons")
os.makedirs(ICONS, exist_ok=True)

S = 512


def make_icon():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # thân lịch
    d.rounded_rectangle([48, 88, 464, 472], radius=64, fill=(255, 255, 255, 255),
                        outline=(31, 41, 55, 255), width=14)
    # header xanh, phần dưới vuông
    d.rounded_rectangle([48, 88, 464, 208], radius=64, fill=(29, 78, 216, 255))
    d.rectangle([48, 160, 464, 208], fill=(29, 78, 216, 255))
    d.rectangle([48, 88, 464, 148], fill=(29, 78, 216, 255))
    # 2 gác bút đầu trang
    d.rounded_rectangle([128, 44, 168, 124], radius=18, fill=(31, 41, 55, 255))
    d.rounded_rectangle([344, 44, 384, 124], radius=18, fill=(31, 41, 55, 255))
    # kẻ ô lịch
    for y in (272, 356, 440):
        d.line([104, y, 408, y], fill=(148, 163, 184, 255), width=18)
    for x in (176, 256, 336):
        d.line([x, 232, x, 440], fill=(226, 232, 240, 255), width=10)
    # chấm đỏ = deadline sắp đến
    d.ellipse([330, 300, 438, 408], fill=(220, 38, 38, 255),
              outline=(255, 255, 255, 255), width=12)
    for size in (128, 48, 16):
        img.resize((size, size), Image.LANCZOS).save(
            os.path.join(ICONS, f"icon{size}.png"))
        print(f"extension/icons/icon{size}.png")


FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/TTF/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]


def fit_font(draw, path, text, max_width, start_size):
    size = start_size
    while size > 10:
        font = ImageFont.truetype(path, size)
        if draw.textlength(text, font=font) <= max_width:
            return font
        size -= 1
    return ImageFont.truetype(path, 10)


def make_promo():
    font_path = next((p for p in FONT_CANDIDATES if os.path.exists(p)), None)
    if not font_path:
        print("promo bỏ qua: không tìm thấy font DejaVu")
        return
    img = Image.new("RGBA", (440, 280), (17, 24, 39, 255))
    d = ImageDraw.Draw(img)
    icon = Image.open(os.path.join(ICONS, "icon128.png"))
    img.paste(icon, (36, 76), icon)
    x, avail = 184, 440 - 184 - 18
    # cùng cỡ cho 2 dòng tiêu đề, chọn cỡ vừa dòng dài nhất
    title_size = ImageFont.truetype(font_path, 30)
    while title_size.size > 10 and d.textlength("HCMIU Deadlines", font=title_size) > avail:
        title_size = ImageFont.truetype(font_path, title_size.size - 1)
    f_sub = fit_font(d, font_path, ".ics export + Google Calendar", avail, 17)
    d.text((x, 84), "Blackboard", font=title_size, fill=(255, 255, 255, 255))
    d.text((x, 124), "HCMIU Deadlines", font=title_size, fill=(255, 255, 255, 255))
    d.text((x, 176), ".ics export + Google Calendar",
           font=f_sub, fill=(148, 163, 184, 255))
    img.save(os.path.join(ROOT, "store", "promo-440x280.png"))
    print("store/promo-440x280.png")


make_icon()
make_promo()
