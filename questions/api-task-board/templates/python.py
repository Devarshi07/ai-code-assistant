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

@app.post('/tasks')
def create_task():
    # Write your code here
    return jsonify(error='not implemented'), 501

@app.get('/tasks')
def list_tasks():
    # Write your code here
    return jsonify(error='not implemented'), 501

@app.get('/tasks/<task_id>')
def get_task(task_id):
    # Write your code here
    return jsonify(error='not implemented'), 501

@app.patch('/tasks/<task_id>')
def update_task(task_id):
    # Write your code here
    return jsonify(error='not implemented'), 501

@app.delete('/tasks/<task_id>')
def delete_task(task_id):
    # Write your code here
    return jsonify(error='not implemented'), 501

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=int(os.environ.get('PORT', '8000')))
