#!/usr/bin/env python3
"""Create a polished WhatsApp profile picture with 'CALTEX TECH WIZARD ☠️' text overlay."""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
import math

# Input and output paths
INPUT_IMAGE = "/home/z/my-project/upload/20260401_161220.jpg"
OUTPUT_JPG = "/home/z/my-project/download/caltex_tech_wizard_profile.jpg"
OUTPUT_PNG = "/home/z/my-project/download/caltex_tech_wizard_profile.png"

# Open the original image
img = Image.open(INPUT_IMAGE).convert("RGBA")

# WhatsApp profile pic size (recommended: 500x500)
PROFILE_SIZE = 500

# Step 1: Crop center square and resize
width, height = img.size
min_dim = min(width, height)
left = (width - min_dim) // 2
top = (height - min_dim) // 2
img_cropped = img.crop((left, top, left + min_dim, top + min_dim))
img_resized = img_cropped.resize((PROFILE_SIZE, PROFILE_SIZE), Image.LANCZOS)

# Step 2: Create a gradient dark overlay on the bottom for text readability
overlay = Image.new("RGBA", (PROFILE_SIZE, PROFILE_SIZE), (0, 0, 0, 0))
draw_overlay = ImageDraw.Draw(overlay)

for y in range(PROFILE_SIZE):
    if y > PROFILE_SIZE * 0.35:
        progress = (y - PROFILE_SIZE * 0.35) / (PROFILE_SIZE * 0.65)
        # Smooth easing curve
        progress = progress * progress
        alpha = int(190 * progress)
        draw_overlay.line([(0, y), (PROFILE_SIZE, y)], fill=(0, 0, 0, alpha))

img_with_overlay = Image.alpha_composite(img_resized, overlay)

# Step 3: Add text
draw = ImageDraw.Draw(img_with_overlay)

# Load fonts
font_bold_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 48)
font_bold_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
font_bold_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 50)

# Try to load Noto Color Emoji for skull
try:
    font_emoji = ImageFont.truetype("/usr/share/fonts/truetype/emoji/NotoColorEmoji.ttf", 40)
except:
    font_emoji = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)

# Text content
line1 = "CALTEX"
line2 = "TECH WIZARD"
skull_text = "☠️"

# Calculate positions
bbox1 = draw.textbbox((0, 0), line1, font=font_bold_large)
w1, h1 = bbox1[2] - bbox1[0], bbox1[3] - bbox1[1]

bbox2 = draw.textbbox((0, 0), line2, font=font_bold_medium)
w2, h2 = bbox2[2] - bbox2[0], bbox2[3] - bbox2[1]

bbox3 = draw.textbbox((0, 0), skull_text, font=font_emoji)
w3, h3 = bbox3[2] - bbox3[0], bbox3[3] - bbox3[1]

# Total text block height
total_height = h1 + 10 + h2 + 10 + h3
start_y = PROFILE_SIZE - total_height - 40

# Line positions (centered)
x1 = (PROFILE_SIZE - w1) // 2
y1 = start_y

x2 = (PROFILE_SIZE - w2) // 2
y2 = y1 + h1 + 10

x3 = (PROFILE_SIZE - w3) // 2
y3 = y2 + h2 + 10

# Shadow settings
shadow_offset = 3
shadow_color = (0, 0, 0, 220)

# Text colors
white = (255, 255, 255, 255)
cyan_accent = (0, 230, 200, 255)
neon_green = (57, 255, 20, 255)

# Draw drop shadows
draw.text((x1 + shadow_offset, y1 + shadow_offset), line1, font=font_bold_large, fill=shadow_color)
draw.text((x2 + shadow_offset, y2 + shadow_offset), line2, font=font_bold_medium, fill=shadow_color)
draw.text((x3 + shadow_offset, y3 + shadow_offset), skull_text, font=font_emoji, fill=shadow_color)

# Draw main text - CALTEX in white, TECH WIZARD in cyan, skull in neon green
draw.text((x1, y1), line1, font=font_bold_large, fill=white)
draw.text((x2, y2), line2, font=font_bold_medium, fill=cyan_accent)
draw.text((x3, y3), skull_text, font=font_emoji, fill=neon_green)

# Step 4: Add glowing border ring
border_layer = Image.new("RGBA", (PROFILE_SIZE, PROFILE_SIZE), (0, 0, 0, 0))
border_draw = ImageDraw.Draw(border_layer)

# Outer glow (multiple rings with decreasing opacity)
for i in range(8, 0, -1):
    alpha = max(10, 100 - i * 12)
    border_draw.ellipse(
        [i, i, PROFILE_SIZE - i, PROFILE_SIZE - i],
        outline=(0, 230, 200, alpha),
        width=2
    )

# Main border ring
border_draw.ellipse(
    [3, 3, PROFILE_SIZE - 3, PROFILE_SIZE - 3],
    outline=(0, 230, 200, 200),
    width=3
)

img_with_border = Image.alpha_composite(img_with_overlay, border_layer)

# Step 5: Apply circular mask
mask = Image.new("L", (PROFILE_SIZE, PROFILE_SIZE), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.ellipse([0, 0, PROFILE_SIZE - 1, PROFILE_SIZE - 1], fill=255)

# Apply mask
output = Image.new("RGBA", (PROFILE_SIZE, PROFILE_SIZE), (0, 0, 0, 0))
output.paste(img_with_border, (0, 0), mask)

# Save PNG with transparency
output.save(OUTPUT_PNG, "PNG")

# Save JPG with black background for outside circle
bg = Image.new("RGB", (PROFILE_SIZE, PROFILE_SIZE), (0, 0, 0))
bg.paste(output, (0, 0), output.split()[3])
bg.save(OUTPUT_JPG, "JPEG", quality=95)

print(f"✅ Profile picture created!")
print(f"   JPG: {OUTPUT_JPG}")
print(f"   PNG: {OUTPUT_PNG}")
print(f"   Size: {PROFILE_SIZE}x{PROFILE_SIZE}")
