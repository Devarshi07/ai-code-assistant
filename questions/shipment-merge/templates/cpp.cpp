#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'mergeShipments' function below.
 *
 * The function is expected to return a 2D_INTEGER_ARRAY.
 * The function accepts 2D_INTEGER_ARRAY windows as parameter.
 */

vector<vector<int>> mergeShipments(vector<vector<int>> windows) {
    // Write your code here
    return {};
}

int main()
{
    string n_temp;
    getline(cin, n_temp);

    int n = stoi(ltrim(rtrim(n_temp)));

    vector<vector<int>> windows(n);

    for (int i = 0; i < n; i++) {
        windows[i].resize(2);

        string windows_row_temp_temp;
        getline(cin, windows_row_temp_temp);

        vector<string> windows_row_temp = split(rtrim(windows_row_temp_temp));

        for (int j = 0; j < 2; j++) {
            int windows_row_item = stoi(windows_row_temp[j]);

            windows[i][j] = windows_row_item;
        }
    }

    vector<vector<int>> result = mergeShipments(windows);

    cout << result.size() << "\n";

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
