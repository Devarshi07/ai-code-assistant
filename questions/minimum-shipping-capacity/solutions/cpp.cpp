#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

// Fewest days the truck needs with the given capacity (greedy loading).
int daysNeeded(const vector<int> &weights, int capacity) {
    int days = 1, load = 0;
    for (int w : weights) {
        load += w;
        if (load > capacity) {
            days++;
            load = w;
        }
    }
    return days;
}

/*
 * Complete the 'minimumCapacity' function below.
 *
 * The function is expected to return an INTEGER.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY weights
 *  2. INTEGER d
 */

int minimumCapacity(vector<int> weights, int d) {
    // Binary search on the answer between the heaviest package and the total weight.
    int lo = 0, hi = 0;
    for (int w : weights) {
        lo = max(lo, w);
        hi += w;
    }
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (daysNeeded(weights, mid) <= d) hi = mid;
        else lo = mid + 1;
    }
    return lo;
}

int main()
{
    string first_multiple_input_temp;
    getline(cin, first_multiple_input_temp);

    vector<string> first_multiple_input = split(rtrim(first_multiple_input_temp));

    int n = stoi(first_multiple_input[0]);

    int d = stoi(first_multiple_input[1]);

    string weights_temp_temp;
    getline(cin, weights_temp_temp);

    vector<string> weights_temp = split(rtrim(weights_temp_temp));

    vector<int> weights(n);

    for (int i = 0; i < n; i++) {
        int weights_item = stoi(weights_temp[i]);

        weights[i] = weights_item;
    }

    int result = minimumCapacity(weights, d);

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
