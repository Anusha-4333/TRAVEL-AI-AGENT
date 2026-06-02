from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

images = {
    
    'maldives.jpg': ('Maldives', (41, 181, 144)),
    'paris.jpg': ('Paris', (183, 95, 210)),
    'bali.jpg': ('Bali', (246, 144, 60)),
    'dubai.jpg': ('Dubai', (231, 76, 60)),
}

output_dir = Path(__file__).resolve().parent.parent / 'static' / 'images'
output_dir.mkdir(parents=True, exist_ok=True)

try:
    font = ImageFont.truetype('arial.ttf', 72)
except Exception:
    font = ImageFont.load_default()

for name, (text, color) in images.items():
    path = output_dir / name
    img = Image.new('RGB', (1200, 800), color)
    draw = ImageDraw.Draw(img)
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    draw.text(((1200 - w) / 2, (800 - h) / 2), text, fill='white', font=font)
    img.save(path, quality=90)
    print(f'created {path}')
