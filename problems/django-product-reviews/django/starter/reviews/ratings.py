"""The rating rules, in one place.

A rating is a whole number from 1 to 5. A product's average rating is the
mean of its *published* ratings, shown to one decimal with halves rounded up
(2.45 is shown as 2.5, 1.15 as 1.2). A product with no published reviews has
no average: `None`, not 0.
"""

MIN_RATING = 1
MAX_RATING = 5


def average(total, count):
    """Mean of `count` ratings adding up to `total`, to one decimal, half up.

    Done in whole numbers: floats cannot hold values such as 1.15 exactly, so
    rounding a float mean can land on the wrong side of the half.
    """
    if not count:
        return None
    tenths = (total * 20 + count) // (2 * count)  # floor(10 * total / count + 1/2)
    return tenths / 10


def summary(total, count):
    """The two numbers shown next to a product."""
    return {"average_rating": average(total, count), "review_count": count}
