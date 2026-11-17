"""The one place that knows what day it is, so tests can pin it."""
from datetime import date


def today():
    return date.today()
