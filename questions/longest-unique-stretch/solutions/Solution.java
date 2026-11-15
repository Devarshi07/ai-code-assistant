import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'longestUniqueStretch' function below.
     *
     * The function is expected to return an INTEGER_ARRAY.
     * The function accepts STRING s as parameter.
     */

    public static List<Integer> longestUniqueStretch(String s) {
        int[] last = new int[128];  // most recent index of each character
        Arrays.fill(last, -1);
        int left = 0, bestLen = 0, bestStart = 0;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (last[c] >= left) left = last[c] + 1;  // the window's left edge only ever moves forward
            last[c] = i;
            if (i - left + 1 > bestLen) {
                bestLen = i - left + 1;
                bestStart = left;
            }
        }
        return Arrays.asList(bestLen, bestStart);
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        String s = bufferedReader.readLine().trim();

        List<Integer> result = Result.longestUniqueStretch(s);

        System.out.println(
            result.stream()
                .map(Object::toString)
                .collect(joining(" "))
        );

        bufferedReader.close();
    }
}
