#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'auditLedger' function below.
 *
 * The function is expected to return a LONG_INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER b
 *  2. INTEGER_ARRAY transactions
 */

vector<long> auditLedger(int b, vector<int> transactions) {
    long balance = b, lowest = b, firstNegative = -1;
    for (size_t i = 0; i < transactions.size(); i++) {
        balance += transactions[i];
        if (balance < 0 && firstNegative == -1) firstNegative = (long) i + 1;
        lowest = min(lowest, balance);
    }
    return {firstNegative, lowest};
}

int main()
{
    string first_multiple_input_temp;
    getline(cin, first_multiple_input_temp);

    vector<string> first_multiple_input = split(rtrim(first_multiple_input_temp));

    int n = stoi(first_multiple_input[0]);

    int b = stoi(first_multiple_input[1]);

    string transactions_temp_temp;
    getline(cin, transactions_temp_temp);

    vector<string> transactions_temp = split(rtrim(transactions_temp_temp));

    vector<int> transactions(n);

    for (int i = 0; i < n; i++) {
        int transactions_item = stoi(transactions_temp[i]);

        transactions[i] = transactions_item;
    }

    vector<long> result = auditLedger(b, transactions);

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
