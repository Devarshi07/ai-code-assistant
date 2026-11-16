from django.db.models import Count, Q
from rest_framework import generics, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from library import clock, services
from library.models import Book, Member
from library.serializers import BookSerializer, LendSerializer, LoanSerializer, MemberSerializer


class BookList(generics.ListCreateAPIView):
    """GET /books/ lists the catalogue with available copies; POST adds a title."""

    serializer_class = BookSerializer

    def get_queryset(self):
        # Count the copies out in the same query instead of one COUNT per book.
        return Book.objects.annotate(on_loan=Count("loans", filter=Q(loans__returned_on__isnull=True)))


class MemberList(generics.ListCreateAPIView):
    queryset = Member.objects.all()
    serializer_class = MemberSerializer


class LoanFilters(serializers.Serializer):
    """Query parameters of GET /loans/."""

    member = serializers.IntegerField(required=False, min_value=1)
    status = serializers.ChoiceField(choices=services.LOAN_STATUSES, required=False)


class LoanListCreate(APIView):
    def get(self, request):
        filters = LoanFilters(data=request.query_params)
        filters.is_valid(raise_exception=True)
        today = clock.today()
        loans = services.list_loans(member_id=filters.validated_data.get("member"),
                                    status=filters.validated_data.get("status"), today=today)
        return Response(LoanSerializer(loans, many=True, context={"today": today}).data)

    def post(self, request):
        body = LendSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        loan = services.lend_book(**body.validated_data)
        return Response(LoanSerializer(loan).data, status=status.HTTP_201_CREATED)


class LoanReturn(APIView):
    def post(self, request, loan_id):
        loan = services.return_loan(loan_id)
        return Response(LoanSerializer(loan).data)


class MemberFines(APIView):
    def get(self, request, member_id):
        return Response(services.member_fines(member_id))
