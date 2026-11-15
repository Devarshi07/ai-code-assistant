#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'shortestPath' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts STRING_ARRAY grid as parameter.
 */

int shortestPath(vector<string> grid) {
    int rows = grid.size(), cols = grid[0].size(), width = cols + 2;
    // Surround the floor with shelves so a step can never leave the grid.
    // blocked marks a cell the robot cannot step into: a shelf, or a cell it has already reached.
    vector<char> blocked((rows + 2) * width, 1);
    int start = -1, end = -1;
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            int cell = (r + 1) * width + c + 1;
            char ch = grid[r][c];
            blocked[cell] = ch == '#';
            if (ch == 'S') start = cell;
            else if (ch == 'E') end = cell;
        }
    }
    vector<int> dist(blocked.size()), queue(rows * cols);
    int moves[4] = {-width, width, -1, 1};
    int head = 0, tail = 0;
    queue[tail++] = start;
    blocked[start] = 1;
    while (head < tail) {  // breadth-first: cells leave the queue in order of distance
        int cell = queue[head++];
        for (int move : moves) {
            int next = cell + move;
            if (!blocked[next]) {
                dist[next] = dist[cell] + 1;
                if (next == end) return dist[next];
                blocked[next] = 1;
                queue[tail++] = next;
            }
        }
    }
    return -1;
}

int main()
{
    string first_multiple_input_temp;
    getline(cin, first_multiple_input_temp);

    vector<string> first_multiple_input = split(rtrim(first_multiple_input_temp));

    int rows = stoi(first_multiple_input[0]);

    int cols = stoi(first_multiple_input[1]);

    vector<string> grid(rows);

    for (int i = 0; i < rows; i++) {
        string grid_item;
        getline(cin, grid_item);

        grid[i] = rtrim(grid_item);
    }

    int result = shortestPath(grid);

    cout << result << "\n";

    return 0;
}

string ltrim(const string &str) {
    string s(str);

    s.erase(s.begin(), find_if(s.begin(), s.end(), [](unsigned char c) { return !isspace(c); }));

    return s;
}

string rtrim(const string &str) {
    string s(str);

    s.erase(find_if(s.rbegin(), s.rend(), [](unsigned char c) { return !isspace(c); }).base(), s.end());

    return s;
}

vector<string> split(const string &str) {
    vector<string> tokens;

    string::size_type start = 0;
    string::size_type end = 0;

    while ((end = str.find(" ", start)) != string::npos) {
        tokens.push_back(str.substr(start, end - start));

        start = end + 1;
    }

    tokens.push_back(str.substr(start));

    return tokens;
}
