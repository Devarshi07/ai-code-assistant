#!/bin/python3

import os
import re

from flask import Flask, jsonify, request

app = Flask(__name__)

# In-memory storage. A fresh app starts for every test case.
tasks = {}
next_id = 1

#
# Complete the endpoints below. Each one should return a JSON body and a
# status code, for example: return jsonify(task), 201
#

def valid_title(value):
    return isinstance(value, str) and 1 <= len(value.strip()) <= 100

def valid_priority(value):
    return type(value) is int and 1 <= value <= 5

def find(task_id):
    return tasks.get(int(task_id)) if re.fullmatch(r'[0-9]+', task_id) else None

@app.post('/tasks')
def create_task():
    global next_id
    body = request.get_json(silent=True)
    if not isinstance(body, dict) or not valid_title(body.get('title')) or ('priority' in body and not valid_priority(body['priority'])):
        return jsonify(error='invalid task'), 400
    task = {'id': next_id, 'title': body['title'].strip(), 'priority': body.get('priority', 3), 'done': False}
    tasks[next_id] = task
    next_id += 1
    return jsonify(task), 201

@app.get('/tasks')
def list_tasks():
    return jsonify(tasks=[tasks[key] for key in sorted(tasks)])

@app.get('/tasks/<task_id>')
def get_task(task_id):
    task = find(task_id)
    if task is None:
        return jsonify(error='task not found'), 404
    return jsonify(task)

@app.patch('/tasks/<task_id>')
def update_task(task_id):
    task = find(task_id)
    if task is None:
        return jsonify(error='task not found'), 404
    body = request.get_json(silent=True)
    if (not isinstance(body, dict)
            or ('title' in body and not valid_title(body['title']))
            or ('priority' in body and not valid_priority(body['priority']))
            or ('done' in body and not isinstance(body['done'], bool))):
        return jsonify(error='invalid task'), 400
    if 'title' in body:
        task['title'] = body['title'].strip()
    if 'priority' in body:
        task['priority'] = body['priority']
    if 'done' in body:
        task['done'] = body['done']
    return jsonify(task)

@app.delete('/tasks/<task_id>')
def delete_task(task_id):
    task = find(task_id)
    if task is None:
        return jsonify(error='task not found'), 404
    del tasks[task['id']]
    return '', 204

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', '8000')))
