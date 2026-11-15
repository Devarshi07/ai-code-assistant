#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'minimumEditCost' function below.
 *
 * The function is expected to return a LONG_INTEGER.
 * The function accepts following parameters:
 *  1. STRING a
 *  2. STRING b
 *  3. INTEGER insertCost
 *  4. INTEGER deleteCost
 *  5. INTEGER replaceCost
 */

long minimumEditCost(string a, string b, int insertCost, int deleteCost, int replaceCost) {
    // Keep one DP row over the shorter string. Turning a into b costs the same
    // as turning b into a with the insert and delete costs swapped.
    if (b.size() > a.size()) {
        swap(a, b);
        swap(insertCost, deleteCost);
    }
    size_t m = b.size();
    vector<long long> prev(m + 1), cur(m + 1);
    for (size_t j = 0; j <= m; j++) prev[j] = (long long) j * insertCost;
    for (size_t i = 1; i <= a.size(); i++) {
        cur[0] = (long long) i * deleteCost;
        for (size_t j = 1; j <= m; j++) {
            long long best = prev[j - 1] + (a[i - 1] == b[j - 1] ? 0 : replaceCost);
            best = min(best, prev[j] + deleteCost);
            best = min(best, cur[j - 1] + insertCost);
            cur[j] = best;
        }
        swap(prev, cur);
    }
    return prev[m];
}

int main()
{
    string a_temp;
    getline(cin, a_temp);

    string a = rtrim(a_temp);

    string b_temp;
    getline(cin, b_temp);

    string b = rtrim(b_temp);

    string first_multiple_input_temp;
    getline(cin, first_multiple_input_temp);

    vector<string> first_multiple_input = split(rtrim(first_multiple_input_temp));

    int insertCost = stoi(first_multiple_input[0]);

    int deleteCost = stoi(first_multiple_input[1]);

    int replaceCost = stoi(first_multiple_input[2]);

    long result = minimumEditCost(a, b, insertCost, deleteCost, replaceCost);

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
