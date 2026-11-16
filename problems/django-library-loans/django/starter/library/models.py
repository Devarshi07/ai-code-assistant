from django.db import models


class Member(models.Model):
    """Someone with a library card."""

    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    joined_on = models.DateField()

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name

    def active_loans(self):
        """Loans this member has not brought back yet."""
        return self.loans.filter(returned_on__isnull=True)


class Book(models.Model):
    """A title in the catalogue. A branch may own several copies of it."""

    title = models.CharField(max_length=200)
    author = models.CharField(max_length=120)
    isbn = models.CharField(max_length=17, unique=True)
    copies = models.PositiveIntegerField(default=1)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.title

    def copies_on_loan(self):
        """How many copies are currently out with members."""
        return self.loans.filter(returned_on__isnull=False).count()

    def available_copies(self):
        return max(self.copies - self.copies_on_loan(), 0)


class Loan(models.Model):
    """One copy of a book lent to one member."""

    member = models.ForeignKey(Member, related_name="loans", on_delete=models.PROTECT)
    book = models.ForeignKey(Book, related_name="loans", on_delete=models.PROTECT)
    lent_on = models.DateField()
    due_on = models.DateField()
    returned_on = models.DateField(null=True, blank=True)
    # Set when the loan is returned; stays 0 for loans returned on time.
    fine_cents = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return f"{self.book} -> {self.member}"

    def status(self, today):
        if self.returned_on is not None:
            return "returned"
        return "overdue" if today > self.due_on else "active"
