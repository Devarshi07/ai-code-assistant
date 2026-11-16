from django.urls import path

from library import views

urlpatterns = [
    path("books/", views.BookList.as_view()),
    path("members/", views.MemberList.as_view()),
    path("members/<int:member_id>/fines/", views.MemberFines.as_view()),
    path("loans/", views.LoanListCreate.as_view()),
    path("loans/<int:loan_id>/return/", views.LoanReturn.as_view()),
]
