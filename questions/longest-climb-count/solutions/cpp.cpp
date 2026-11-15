#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'longestClimb' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts INTEGER_ARRAY alt as parameter.
 */

vector<int> longestClimb(vector<int> alt) {
    const long long MOD = 1000000007LL;
    // A Fenwick tree over value ranks: node i stores the longest climb ending at a
    // value whose rank lies in its range, and how many such climbs there are.
    vector<int> distinct(alt);
    sort(distinct.begin(), distinct.end());
    distinct.erase(unique(distinct.begin(), distinct.end()), distinct.end());
    int size = distinct.size();
    vector<int> treeLen(size + 1, 0);
    vector<long long> treeCnt(size + 1, 0);
    for (int v : alt) {
        int r = lower_bound(distinct.begin(), distinct.end(), v) - distinct.begin() + 1;
        int best = 0;
        long long ways = 1;
        for (int i = r - 1; i > 0; i &= i - 1) {
            if (treeLen[i] > best) { best = treeLen[i]; ways = treeCnt[i]; }
            else if (treeLen[i] == best) ways += treeCnt[i];
        }
        best++;
        ways %= MOD;
        for (int i = r; i <= size; i += i & -i) {
            if (treeLen[i] < best) { treeLen[i] = best; treeCnt[i] = ways; }
            else if (treeLen[i] == best) treeCnt[i] = (treeCnt[i] + ways) % MOD;
        }
    }
    int best = 0;
    long long ways = 0;
    for (int i = size; i > 0; i &= i - 1) {
        if (treeLen[i] > best) { best = treeLen[i]; ways = treeCnt[i]; }
        else if (treeLen[i] == best) ways += treeCnt[i];
    }
    return {best, (int) (ways % MOD)};
}

int main()
{
    string n_temp;
    getline(cin, n_temp);

    int n = stoi(ltrim(rtrim(n_temp)));

    string alt_temp_temp;
    getline(cin, alt_temp_temp);

    vector<string> alt_temp = split(rtrim(alt_temp_temp));

    vector<int> alt(n);

    for (int i = 0; i < n; i++) {
        int alt_item = stoi(alt_temp[i]);

        alt[i] = alt_item;
    }

    vector<int> result = longestClimb(alt);

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
