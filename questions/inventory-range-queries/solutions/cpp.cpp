#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'processOperations' function below.
 *
 * The function is expected to return a LONG_INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY stock
 *  2. 2D_INTEGER_ARRAY operations
 */

vector<long> processOperations(vector<int> stock, vector<vector<int>> operations) {
    // A Fenwick tree over the shelves, plus each shelf's current value so a
    // recount becomes an update by the difference.
    int n = stock.size();
    vector<long> current(n + 1, 0), tree(n + 1, 0);
    for (int i = 1; i <= n; i++) {
        current[i] = stock[i - 1];
        tree[i] += current[i];
        int parent = i + (i & -i);
        if (parent <= n) tree[parent] += tree[i];
    }
    vector<long> answers;
    for (const vector<int> &op : operations) {
        int kind = op[0], x = op[1], y = op[2];
        if (kind == 1) {
            long delta = y - current[x];
            current[x] = y;
            for (int i = x; i <= n; i += i & -i) tree[i] += delta;
        } else {
            long total = 0;
            for (int i = y; i > 0; i &= i - 1) total += tree[i];
            for (int i = x - 1; i > 0; i &= i - 1) total -= tree[i];
            answers.push_back(total);
        }
    }
    return answers;
}

int main()
{
    string first_multiple_input_temp;
    getline(cin, first_multiple_input_temp);

    vector<string> first_multiple_input = split(rtrim(first_multiple_input_temp));

    int n = stoi(first_multiple_input[0]);

    int q = stoi(first_multiple_input[1]);

    string stock_temp_temp;
    getline(cin, stock_temp_temp);

    vector<string> stock_temp = split(rtrim(stock_temp_temp));

    vector<int> stock(n);

    for (int i = 0; i < n; i++) {
        int stock_item = stoi(stock_temp[i]);

        stock[i] = stock_item;
    }

    vector<vector<int>> operations(q);

    for (int i = 0; i < q; i++) {
        operations[i].resize(3);

        string operations_row_temp_temp;
        getline(cin, operations_row_temp_temp);

        vector<string> operations_row_temp = split(rtrim(operations_row_temp_temp));

        for (int j = 0; j < 3; j++) {
            int operations_row_item = stoi(operations_row_temp[j]);

            operations[i][j] = operations_row_item;
        }
    }

    vector<long> result = processOperations(stock, operations);

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
