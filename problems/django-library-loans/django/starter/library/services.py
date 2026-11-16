"""Lending rules. Views stay thin and call these functions."""
from datetime import timedelta

from django.conf import settings
from django.db import transaction

from library import clock
from library.errors import AlreadyBorrowed, LoanLimitReached, NotAvailable, NotFound
from library.models import Book, Loan, Member

LOAN_STATUSES = ("active", "overdue", "returned")


def get_member(member_id):
    try:
        return Member.objects.get(pk=member_id)
    except Member.DoesNotExist:
        raise NotFound(f"Member {member_id} does not exist.")


def get_book(book_id):
    try:
        return Book.objects.get(pk=book_id)
    except Book.DoesNotExist:
        raise NotFound(f"Book {book_id} does not exist.")


def get_loan(loan_id):
    try:
        return Loan.objects.get(pk=loan_id)
    except Loan.DoesNotExist:
        raise NotFound(f"Loan {loan_id} does not exist.")


@transaction.atomic
def lend_book(*, member_id, book_id, today=None):
    """Lends one copy of a book to a member, due LOAN_DAYS from today."""
    today = today or clock.today()
    member = get_member(member_id)
    book = get_book(book_id)
    active = member.active_loans()
    if active.filter(book=book).exists():
        raise AlreadyBorrowed(f"{member.name} already has a copy of {book.title}.")
    if active.count() >= settings.MAX_ACTIVE_LOANS:
        raise LoanLimitReached(f"{member.name} already has {settings.MAX_ACTIVE_LOANS} books out.", limit=settings.MAX_ACTIVE_LOANS)
    if book.available_copies() <= 0:
        raise NotAvailable(f"Every copy of {book.title} is out on loan.")
    return Loan.objects.create(member=member, book=book, lent_on=today, due_on=today + timedelta(days=settings.LOAN_DAYS))


def list_loans(*, member_id=None, status=None, today=None):
    """Loans for GET /loans/, optionally for one member and in one status.

    `status` is one of LOAN_STATUSES:
      active   - not returned, due today or later
      overdue  - not returned, due date has passed
      returned - brought back
    """
    today = today or clock.today()
    loans = Loan.objects.all()
    if member_id is not None:
        loans = loans.filter(member_id=member_id)
    # Phase 2: filter by status.
    return loans


def return_loan(loan_id, *, today=None):
    """Marks a loan returned today and records its late fine."""
    raise NotImplementedError("Phase 2: return a loan and record its fine")


def member_fines(member_id, *, today=None):
    """The fines a member owes or is running up: the body of GET /members/<id>/fines/."""
    raise NotImplementedError("Phase 2: list a member's fines")
