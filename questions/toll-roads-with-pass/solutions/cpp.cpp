#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'cheapestTrip' function below.
 *
 * The function is expected to return a LONG_INTEGER.
 * The function accepts following parameters:
 *  1. INTEGER n
 *  2. 2D_INTEGER_ARRAY roads
 */

long cheapestTrip(int n, vector<vector<int>> roads) {
    vector<vector<pair<int, int>>> adj(n + 1);
    for (const auto &r : roads) {
        adj[r[0]].push_back({r[1], r[2]});
        adj[r[1]].push_back({r[0], r[2]});
    }

    // Dijkstra over states (town, pass used?), encoded as 2 * town + used.
    const long long INF = LLONG_MAX;
    vector<long long> dist(2 * n + 2, INF);
    priority_queue<pair<long long, int>, vector<pair<long long, int>>, greater<pair<long long, int>>> heap;
    dist[2] = 0;
    heap.push({0, 2});
    while (!heap.empty()) {
        auto [d, state] = heap.top();
        heap.pop();
        if (d > dist[state]) continue;
        int town = state >> 1, used = state & 1;
        // The first state of town n to leave the heap is the cheapest one.
        if (town == n) return d;
        for (auto [next, c] : adj[town]) {
            int target = 2 * next + used;
            if (d + c < dist[target]) {
                dist[target] = d + c;
                heap.push({dist[target], target});
            }
            if (!used) {
                target = 2 * next + 1;
                if (d + c / 2 < dist[target]) {
                    dist[target] = d + c / 2;
                    heap.push({dist[target], target});
                }
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

    int n = stoi(first_multiple_input[0]);

    int m = stoi(first_multiple_input[1]);

    vector<vector<int>> roads(m);

    for (int i = 0; i < m; i++) {
        roads[i].resize(3);

        string roads_row_temp_temp;
        getline(cin, roads_row_temp_temp);

        vector<string> roads_row_temp = split(rtrim(roads_row_temp_temp));

        for (int j = 0; j < 3; j++) {
            int roads_row_item = stoi(roads_row_temp[j]);

            roads[i][j] = roads_row_item;
        }
    }

    long result = cheapestTrip(n, roads);

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
