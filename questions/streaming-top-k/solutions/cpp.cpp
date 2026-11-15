#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'topTracks' function below.
 *
 * The function is expected to return a 2D_INTEGER_ARRAY.
 * The function accepts 2D_INTEGER_ARRAY events as parameter.
 */

vector<vector<int>> topTracks(vector<vector<int>> events) {
    // Entries are {-plays, track}, so the smallest entry is the leader. Each play adds a fresh
    // entry, and entries whose play count is out of date are discarded when they surface.
    unordered_map<int, int> plays;
    priority_queue<pair<int, int>, vector<pair<int, int>>, greater<pair<int, int>>> heap;
    vector<vector<int>> answers;
    for (const vector<int> &event : events) {
        int type = event[0], value = event[1];
        if (type == 1) {
            int count = ++plays[value];
            heap.push({-count, value});
        } else {
            vector<pair<int, int>> top;
            while (!heap.empty() && (int) top.size() < value) {
                pair<int, int> entry = heap.top();
                heap.pop();
                if (plays[entry.second] == -entry.first) top.push_back(entry);
            }
            vector<int> ids;
            for (const pair<int, int> &entry : top) {
                heap.push(entry);
                ids.push_back(entry.second);
            }
            answers.push_back(ids);
        }
    }
    return answers;
}

int main()
{
    string q_temp;
    getline(cin, q_temp);

    int q = stoi(ltrim(rtrim(q_temp)));

    vector<vector<int>> events(q);

    for (int i = 0; i < q; i++) {
        events[i].resize(2);

        string events_row_temp_temp;
        getline(cin, events_row_temp_temp);

        vector<string> events_row_temp = split(rtrim(events_row_temp_temp));

        for (int j = 0; j < 2; j++) {
            int events_row_item = stoi(events_row_temp[j]);

            events[i][j] = events_row_item;
        }
    }

    vector<vector<int>> result = topTracks(events);

    for (size_t i = 0; i < result.size(); i++) {
        for (size_t j = 0; j < result[i].size(); j++) {
            cout << result[i][j];

            if (j != result[i].size() - 1) {
                cout << " ";
            }
        }

        cout << "\n";
    }

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
