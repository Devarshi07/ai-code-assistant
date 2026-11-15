#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'topWords' function below.
 *
 * The function is expected to return a STRING_ARRAY.
 * The function accepts following parameters:
 *  1. STRING_ARRAY lines
 *  2. INTEGER k
 */

vector<string> topWords(vector<string> lines, int k) {
    unordered_map<string, int> counts;
    for (const string &line : lines) {
        istringstream words(line);
        string word;
        while (words >> word) counts[word]++;
    }
    vector<pair<string, int>> ranked(counts.begin(), counts.end());
    sort(ranked.begin(), ranked.end(), [](const pair<string, int> &a, const pair<string, int> &b) {
        if (a.second != b.second) return a.second > b.second;
        return a.first < b.first;
    });
    vector<string> result;
    for (int i = 0; i < k && i < (int) ranked.size(); i++) {
        result.push_back(ranked[i].first + " " + to_string(ranked[i].second));
    }
    return result;
}

int main()
{
    string first_multiple_input_temp;
    getline(cin, first_multiple_input_temp);

    vector<string> first_multiple_input = split(rtrim(first_multiple_input_temp));

    int m = stoi(first_multiple_input[0]);

    int k = stoi(first_multiple_input[1]);

    vector<string> lines(m);

    for (int i = 0; i < m; i++) {
        string lines_item;
        getline(cin, lines_item);

        lines[i] = rtrim(lines_item);
    }

    vector<string> result = topWords(lines, k);

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
