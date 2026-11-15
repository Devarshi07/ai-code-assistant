import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.toList;

class Result {

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

    public static long minimumEditCost(String a, String b, int insertCost, int deleteCost, int replaceCost) {
        // Keep one DP row over the shorter string. Turning a into b costs the same
        // as turning b into a with the insert and delete costs swapped.
        if (b.length() > a.length()) {
            String s = a; a = b; b = s;
            int c = insertCost; insertCost = deleteCost; deleteCost = c;
        }
        char[] x = a.toCharArray(), y = b.toCharArray();
        int m = y.length;
        long[] prev = new long[m + 1], cur = new long[m + 1];
        for (int j = 0; j <= m; j++) prev[j] = (long) j * insertCost;
        for (int i = 1; i <= x.length; i++) {
            cur[0] = (long) i * deleteCost;
            for (int j = 1; j <= m; j++) {
                long best = prev[j - 1] + (x[i - 1] == y[j - 1] ? 0 : replaceCost);
                best = Math.min(best, prev[j] + deleteCost);
                best = Math.min(best, cur[j - 1] + insertCost);
                cur[j] = best;
            }
            long[] t = prev; prev = cur; cur = t;
        }
        return prev[m];
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        String a = bufferedReader.readLine().replaceAll("\\s+$", "");

        String b = bufferedReader.readLine().replaceAll("\\s+$", "");

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int insertCost = Integer.parseInt(firstMultipleInput[0]);

        int deleteCost = Integer.parseInt(firstMultipleInput[1]);

        int replaceCost = Integer.parseInt(firstMultipleInput[2]);

        long result = Result.minimumEditCost(a, b, insertCost, deleteCost, replaceCost);

        System.out.println(result);

        bufferedReader.close();
    }
}
