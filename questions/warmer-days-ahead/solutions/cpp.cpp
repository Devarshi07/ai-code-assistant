#include <bits/stdc++.h>

using namespace std;

string ltrim(const string &);
string rtrim(const string &);
vector<string> split(const string &);

/*
 * Complete the 'daysUntilWarmer' function below.
 *
 * The function is expected to return an INTEGER_ARRAY.
 * The function accepts INTEGER_ARRAY temperatures as parameter.
 */

vector<int> daysUntilWarmer(vector<int> temperatures) {
    int n = temperatures.size();
    vector<int> answer(n, 0);
    // Days still waiting for a warmer reading. Their readings never rise from
    // the bottom of the stack to the top, so a new reading settles them from the top.
    vector<int> waiting;
    waiting.reserve(n);
    for (int i = 0; i < n; i++) {
        while (!waiting.empty() && temperatures[waiting.back()] < temperatures[i]) {
            answer[waiting.back()] = i - waiting.back();
            waiting.pop_back();
        }
        waiting.push_back(i);
    }
    return answer;
}

int main()
{
    string n_temp;
    getline(cin, n_temp);

    int n = stoi(ltrim(rtrim(n_temp)));

    string temperatures_temp_temp;
    getline(cin, temperatures_temp_temp);

    vector<string> temperatures_temp = split(rtrim(temperatures_temp_temp));

    vector<int> temperatures(n);

    for (int i = 0; i < n; i++) {
        int temperatures_item = stoi(temperatures_temp[i]);

        temperatures[i] = temperatures_item;
    }

    vector<int> result = daysUntilWarmer(temperatures);

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
