#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'rollingMedian' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts following parameters:
 *  1. INTEGER_ARRAY latency
 *  2. INTEGER k
 */

vector<int> rollingMedian(vector<int> latency, int k) {
    // lo (a max-heap) holds the smaller ceil(size / 2) values of the window and
    // hi the rest, so the lower median is the top of lo. A key packs
    // (value, index) into one 64-bit integer, unique per element; entries that
    // left the window are discarded lazily when they reach a heap's top.
    const int SHIFT = 17;
    const long long MASK = (1LL << SHIFT) - 1;
    int n = latency.size();
    vector<long long> keys(n);
    for (int i = 0; i < n; i++) keys[i] = ((long long) latency[i] << SHIFT) | i;
    priority_queue<long long> lo;
    priority_queue<long long, vector<long long>, greater<long long>> hi;
    int loSize = 0, hiSize = 0;
    vector<int> medians;
    medians.reserve(n - k + 1);
    for (int i = 0; i < n; i++) {
        int start = i - k + 1;
        if (i >= k) {
            if (keys[i - k] <= lo.top()) loSize--;
            else hiSize--;
        }
        while (!lo.empty() && (lo.top() & MASK) < start) lo.pop();
        if (!lo.empty() && keys[i] < lo.top()) { lo.push(keys[i]); loSize++; }
        else { hi.push(keys[i]); hiSize++; }
        if (loSize > hiSize + 1) {
            while ((lo.top() & MASK) < start) lo.pop();
            hi.push(lo.top());
            lo.pop();
            loSize--; hiSize++;
        } else if (loSize < hiSize) {
            while ((hi.top() & MASK) < start) hi.pop();
            lo.push(hi.top());
            hi.pop();
            loSize++; hiSize--;
        }
        if (start >= 0) {
            while ((lo.top() & MASK) < start) lo.pop();
            medians.push_back((int) (lo.top() >> SHIFT));
        }
    }
    return medians;
}

int main()
{
    string first_multiple_input_temp;
    getline(cin, first_multiple_input_temp);

    vector<string> first_multiple_input = split(rtrim(first_multiple_input_temp));

    int n = stoi(first_multiple_input[0]);

    int k = stoi(first_multiple_input[1]);

    string latency_temp_temp;
    getline(cin, latency_temp_temp);

    vector<string> latency_temp = split(rtrim(latency_temp_temp));

    vector<int> latency(n);

    for (int i = 0; i < n; i++) {
        int latency_item = stoi(latency_temp[i]);

        latency[i] = latency_item;
    }

    vector<int> result = rollingMedian(latency, k);

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
