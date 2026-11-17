from django.urls import path

from board import views

urlpatterns = [
    path("projects/", views.ProjectList.as_view()),
    path("projects/<int:project_id>/tasks/", views.ProjectTasks.as_view()),
    path("projects/<int:project_id>/dashboard/", views.ProjectDashboard.as_view()),
    path("tasks/<int:task_id>/", views.TaskDetail.as_view()),
]
