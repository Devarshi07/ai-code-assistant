#include <bits/stdc++.h>

using namespace std;

string rtrim(const string &);

/*
 * Complete the 'longestUniqueStretch' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts STRING s as parameter.
 */

vector<int> longestUniqueStretch(string s) {
    // Write your code here
    return {};
}

int main()
{
    string s_temp;
    getline(cin, s_temp);

    string s = rtrim(s_temp);

    vector<int> result = longestUniqueStretch(s);

    for (size_t i = 0; i < result.size(); i++) {
        cout << result[i];

        if (i != result.size() - 1) {
            cout << " ";
        }
    }

    cout << "\n";

    return 0;
}

string rtrim(const string &str) {
    string s(str);

    s.erase(find_if(s.rbegin(), s.rend(), [](unsigned char c) { return !isspace(c); }).base(), s.end());

    return s;
}
