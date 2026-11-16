from rest_framework import serializers

from library import clock
from library.models import Book, Loan, Member


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["id", "name", "email", "joined_on"]


class BookSerializer(serializers.ModelSerializer):
    available = serializers.SerializerMethodField()

    class Meta:
        model = Book
        fields = ["id", "title", "author", "isbn", "copies", "available"]

    def get_available(self, book):
        on_loan = getattr(book, "on_loan", None)  # annotated by BookList
        if on_loan is None:
            return book.available_copies()
        return max(book.copies - on_loan, 0)


class MemberSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["id", "name"]


class BookSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Book
        fields = ["id", "title", "author"]


class LoanSerializer(serializers.ModelSerializer):
    member = MemberSummarySerializer(read_only=True)
    book = BookSummarySerializer(read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = Loan
        fields = ["id", "member", "book", "lent_on", "due_on", "returned_on", "fine_cents", "status"]

    def get_status(self, loan):
        return loan.status(self.context.get("today") or clock.today())


class LendSerializer(serializers.Serializer):
    """Body of POST /loans/."""

    member_id = serializers.IntegerField(min_value=1)
    book_id = serializers.IntegerField(min_value=1)
