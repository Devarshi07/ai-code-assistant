"""Runs a candidate's SQL query against an in-memory SQLite database.

stdin: the SQL that creates and fills the tables for one test case.
argv:  the query file, plus --unordered when row order doesn't matter.
Prints a header of lower-case column names, then one line per row, with
values separated by tabs. NULL prints as NULL; numbers print without float
noise (10 significant digits), so 3 and 3.0 look the same.
"""
import sqlite3
import sys


def cell(value):
    if value is None:
        return 'NULL'
    if isinstance(value, float):
        return format(value, '.10g')
    if isinstance(value, bytes):
        return value.hex()
    return str(value).replace('\t', ' ').replace('\r', ' ').replace('\n', ' ')


def run_query(setup, query, unordered=False):
    """Returns the printed result, or raises sqlite3.Error / ValueError."""
    db = sqlite3.connect(':memory:')
    try:
        db.executescript(setup)
        statement = query.strip()
        while statement.endswith(';'):
            statement = statement[:-1].rstrip()
        if not statement:
            raise ValueError('The query file is empty. Write one SELECT statement.')
        cursor = db.execute(statement)
        if cursor.description is None:
            raise ValueError('Your statement returned no rows. Write a SELECT (or WITH ... SELECT) statement.')
        header = '\t'.join(column[0].lower() for column in cursor.description)
        rows = ['\t'.join(cell(value) for value in row) for row in cursor.fetchall()]
        if unordered:
            rows.sort()
        return '\n'.join([header, *rows]) + '\n'
    finally:
        db.close()


def main():
    args = sys.argv[1:]
    paths = [arg for arg in args if not arg.startswith('--')]
    with open(paths[0], encoding='utf-8') as handle:
        query = handle.read()
    try:
        sys.stdout.write(run_query(sys.stdin.read(), query, '--unordered' in args))
    except (sqlite3.Error, ValueError) as error:
        print(f'{type(error).__name__}: {error}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
