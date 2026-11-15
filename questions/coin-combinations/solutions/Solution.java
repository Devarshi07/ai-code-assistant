import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'countWays' function below.
     *
     * The function is expected to return an INTEGER.
     * The function accepts following parameters:
     *  1. INTEGER amount
     *  2. INTEGER_ARRAY coins
     */

    public static int countWays(int amount, List<Integer> coins) {
        final long MOD = 1_000_000_007L;
        // ways[a] = number of payouts for amount a using the coins processed so far
        long[] ways = new long[amount + 1];
        ways[0] = 1;
        for (int c : coins) {
            for (int a = c; a <= amount; a++) {
                ways[a] = (ways[a] + ways[a - c]) % MOD;
            }
        }
        return (int) ways[amount];
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int n = Integer.parseInt(firstMultipleInput[0]);

        int amount = Integer.parseInt(firstMultipleInput[1]);

        List<Integer> coins = Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
            .map(Integer::parseInt)
            .collect(toList());

        int result = Result.countWays(amount, coins);

        System.out.println(result);

        bufferedReader.close();
    }
}
