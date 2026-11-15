#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'playlistQueries' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY tracks
 *  2. INTEGER d
 *  3. INTEGER_ARRAY positions
 */

vector<int> playlistQueries(vector<int> tracks, int d, vector<int> positions) {
    // Write your code here
    return {};
}

int main()
{
    string first_multiple_input_temp;
    getline(cin, first_multiple_input_temp);

    vector<string> first_multiple_input = split(rtrim(first_multiple_input_temp));

    int n = stoi(first_multiple_input[0]);

    int d = stoi(first_multiple_input[1]);

    int q = stoi(first_multiple_input[2]);

    string tracks_temp_temp;
    getline(cin, tracks_temp_temp);

    vector<string> tracks_temp = split(rtrim(tracks_temp_temp));

    vector<int> tracks(n);

    for (int i = 0; i < n; i++) {
        int tracks_item = stoi(tracks_temp[i]);

        tracks[i] = tracks_item;
    }

    string positions_temp_temp;
    getline(cin, positions_temp_temp);

    vector<string> positions_temp = split(rtrim(positions_temp_temp));

    vector<int> positions(q);

    for (int i = 0; i < q; i++) {
        int positions_item = stoi(positions_temp[i]);

        positions[i] = positions_item;
    }

    vector<int> result = playlistQueries(tracks, d, positions);

    for (size_t i = 0; i < result.size(); i++) {
        cout << result[i];

        if (i != result.size() - 1) {
            cout << "\n";
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
