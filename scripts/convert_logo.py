import cairosvg

# Convert SVG to PNG
cairosvg.svg2png(url='logo-512x512.svg', write_to='logo-512x512.png')

# Convert SVG to JPG (via PNG intermediate)
from PIL import Image
png_image = Image.open('logo-512x512.png')
rgb_image = png_image.convert('RGB')
rgb_image.save('logo-512x512.jpg', quality=95)
