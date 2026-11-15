#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'countIslands' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER m
 *  2. INTEGER n
 *  3. 2D_INTEGER_ARRAY cells
 */

vector<int> countIslands(int m, int n, vector<vector<int>> cells) {
    // Union-find over the m * n cells (cell id r * n + c); parent[x] == -1 marks water.
    vector<int> parent(m * n, -1), size(m * n, 1);
    auto find = [&](int x) {
        int root = x;
        while (parent[root] != root) root = parent[root];
        while (parent[x] != root) {
            int next = parent[x];
            parent[x] = root;
            x = next;
        }
        return root;
    };
    const int dr[4] = {-1, 1, 0, 0}, dc[4] = {0, 0, -1, 1};
    int islands = 0;
    vector<int> result;
    result.reserve(cells.size());
    for (const vector<int> &raised : cells) {
        int r = raised[0], c = raised[1];
        int cell = r * n + c;
        if (parent[cell] == -1) {
            parent[cell] = cell;
            islands++;
            for (int d = 0; d < 4; d++) {
                int nr = r + dr[d], nc = c + dc[d];
                if (nr < 0 || nr >= m || nc < 0 || nc >= n || parent[nr * n + nc] == -1) continue;
                int a = find(cell), b = find(nr * n + nc);
                if (a != b) {
                    if (size[a] < size[b]) swap(a, b);
                    parent[b] = a;
                    size[a] += size[b];
                    islands--;
                }
            }
        }
        result.push_back(islands);
    }
    return result;
}

int main()
{
    string first_multiple_input_temp;
    getline(cin, first_multiple_input_temp);

    vector<string> first_multiple_input = split(rtrim(first_multiple_input_temp));

    int m = stoi(first_multiple_input[0]);

    int n = stoi(first_multiple_input[1]);

    int q = stoi(first_multiple_input[2]);

    vector<vector<int>> cells(q);

    for (int i = 0; i < q; i++) {
        cells[i].resize(2);

        string cells_row_temp_temp;
        getline(cin, cells_row_temp_temp);

        vector<string> cells_row_temp = split(rtrim(cells_row_temp_temp));

        for (int j = 0; j < 2; j++) {
            int cells_row_item = stoi(cells_row_temp[j]);

            cells[i][j] = cells_row_item;
        }
    }

    vector<int> result = countIslands(m, n, cells);

    for (size_t i = 0; i < result.size(); i++) {
        cout << result[i];

        if (i != result.size() - 1) {
            cout << " ";
        }
    }

    cout << "\n";

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
