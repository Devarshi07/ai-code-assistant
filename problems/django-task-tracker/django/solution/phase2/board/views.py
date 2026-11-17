from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from board import clock, services
from board.models import Project
from board.serializers import (ProjectSerializer, TaskFilters, TaskSerializer, TaskWriteSerializer,
                               TransitionSerializer)


def page_body(page):
    return {"count": page.count, "page": page.page, "page_size": page.page_size,
            "results": TaskSerializer(page.items, many=True).data}


class ProjectList(APIView):
    """GET /projects/ lists the projects the signed-in user belongs to."""

    def get(self, request):
        projects = Project.objects.filter(members=request.user)
        return Response(ProjectSerializer(projects, many=True).data)


class ProjectTasks(APIView):
    def get(self, request, project_id):
        project = services.get_project(request.user, project_id)
        filters = TaskFilters(data=request.query_params)
        filters.is_valid(raise_exception=True)
        params = dict(filters.validated_data)
        if "overdue" in params:
            params["overdue"] = params["overdue"] == "true"
        return Response(page_body(services.list_tasks(project, today=clock.today(), **params)))

    def post(self, request, project_id):
        project = services.get_project(request.user, project_id)
        body = TaskWriteSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        task = services.create_task(project, body.validated_data)
        return Response(TaskSerializer(task).data, status=status.HTTP_201_CREATED)


class TaskDetail(APIView):
    def get(self, request, task_id):
        task = services.get_task(request.user, task_id)
        return Response(TaskSerializer(task).data)

    def patch(self, request, task_id):
        task = services.get_task(request.user, task_id)
        body = TaskWriteSerializer(data=request.data, partial=True)
        body.is_valid(raise_exception=True)
        task = services.update_task(task, body.validated_data)
        return Response(TaskSerializer(task).data)


class TaskTransition(APIView):
    def post(self, request, task_id):
        body = TransitionSerializer(data=request.data)
        body.is_valid(raise_exception=True)
        task = services.transition_task(request.user, task_id, body.validated_data["status"],
                                        body.validated_data["reason"])
        return Response(TaskSerializer(task).data)


class ProjectDashboard(APIView):
    def get(self, request, project_id):
        project = services.get_project(request.user, project_id)
        return Response(services.project_dashboard(project, clock.today()))
