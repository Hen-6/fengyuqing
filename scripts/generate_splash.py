from PIL import Image

# Open icon
try:
    icon = Image.open('assets/icon.png').convert("RGBA")
except Exception as e:
    print(f"Error opening icon: {e}")
    exit(1)

# Desired dimensions
bg_size = 2732

# Create background (using the top-left pixel color of the icon as the fill, or a paper texture color)
# Let's sample top-left pixel of icon
bg_color = icon.getpixel((0, 0))

splash = Image.new('RGBA', (bg_size, bg_size), bg_color)

# Resize icon to something reasonable for center, e.g. 512x512
icon = icon.resize((512, 512), Image.Resampling.LANCZOS)

# Paste centered
offset = ((bg_size - 512) // 2, (bg_size - 512) // 2)
splash.paste(icon, offset, icon)

splash.save('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png')
splash.save('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png')
splash.save('ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png')

print("Splash screens generated successfully.")
