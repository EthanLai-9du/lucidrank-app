import sys
from PIL import ImageGrab
ImageGrab.grab(xdisplay=':77').save(sys.argv[1]); print('saved', sys.argv[1])
