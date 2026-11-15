#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'minMeetingRooms' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts 2D_INTEGER_ARRAY meetings as parameter.
 */

int minMeetingRooms(vector<vector<int>> meetings) {
    // Write your code here
    return 0;
}

int main()
{
    string n_temp;
    getline(cin, n_temp);

    int n = stoi(ltrim(rtrim(n_temp)));

    vector<vector<int>> meetings(n);

    for (int i = 0; i < n; i++) {
        meetings[i].resize(2);

        string meetings_row_temp_temp;
        getline(cin, meetings_row_temp_temp);

        vector<string> meetings_row_temp = split(rtrim(meetings_row_temp_temp));

        for (int j = 0; j < 2; j++) {
            int meetings_row_item = stoi(meetings_row_temp[j]);

            meetings[i][j] = meetings_row_item;
        }
    }

    int result = minMeetingRooms(meetings);

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
