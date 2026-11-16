"""Lending rules. Views stay thin and call these functions."""
from datetime import timedelta

from django.conf import settings
from django.db import transaction

from library import clock
from library.errors import AlreadyBorrowed, AlreadyReturned, LoanLimitReached, NotAvailable, NotFound
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
    # One query: the member and book of each loan come in the same SELECT.
    loans = Loan.objects.select_related("member", "book")
    if member_id is not None:
        loans = loans.filter(member_id=member_id)
    if status == "returned":
        loans = loans.filter(returned_on__isnull=False)
    elif status == "overdue":
        loans = loans.filter(returned_on__isnull=True, due_on__lt=today)
    elif status == "active":
        loans = loans.filter(returned_on__isnull=True, due_on__gte=today)
    return loans


def fine_for(days_late):
    """The fine for a loan that is `days_late` days late, capped at MAX_FINE_CENTS."""
    return min(max(days_late, 0) * settings.FINE_PER_DAY_CENTS, settings.MAX_FINE_CENTS)


@transaction.atomic
def return_loan(loan_id, *, today=None):
    """Marks a loan returned today and records its late fine."""
    today = today or clock.today()
    loan = get_loan(loan_id)
    if loan.returned_on is not None:
        raise AlreadyReturned(f"Loan {loan.id} was already returned on {loan.returned_on}.", returned_on=loan.returned_on.isoformat())
    loan.returned_on = today
    loan.fine_cents = fine_for((today - loan.due_on).days)
    loan.save(update_fields=["returned_on", "fine_cents"])
    return loan


def member_fines(member_id, *, today=None):
    """The fines a member owes or is running up: the body of GET /members/<id>/fines/.

    Returned loans contribute the fine recorded when they came back. Loans that
    are still out and overdue contribute the fine so far, marked "accruing".
    """
    today = today or clock.today()
    member = get_member(member_id)
    items = []
    for loan in member.loans.select_related("book"):
        if loan.returned_on is not None:
            if not loan.fine_cents:
                continue
            late, fine, accruing = max((loan.returned_on - loan.due_on).days, 0), loan.fine_cents, False
        elif today > loan.due_on:
            late = (today - loan.due_on).days
            fine, accruing = fine_for(late), True
        else:
            continue
        items.append({"loan_id": loan.id, "title": loan.book.title, "due_on": loan.due_on.isoformat(),
                      "days_late": late, "fine_cents": fine, "accruing": accruing})
    return {"member_id": member.id, "total_cents": sum(item["fine_cents"] for item in items), "items": items}
