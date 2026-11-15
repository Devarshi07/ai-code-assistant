import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'minimumCapacity' function below.
     *
     * The function is expected to return an INTEGER.
     * The function accepts following parameters:
     *  1. INTEGER_ARRAY weights
     *  2. INTEGER d
     */

    public static int minimumCapacity(List<Integer> weights, int d) {
        int[] w = weights.stream().mapToInt(Integer::intValue).toArray();
        // Binary search on the answer between the heaviest package and the total weight.
        int lo = 0, hi = 0;
        for (int x : w) {
            lo = Math.max(lo, x);
            hi += x;
        }
        while (lo < hi) {
            int mid = lo + (hi - lo) / 2;
            if (daysNeeded(w, mid) <= d) hi = mid;
            else lo = mid + 1;
        }
        return lo;
    }

    // Fewest days the truck needs with the given capacity (greedy loading).
    private static int daysNeeded(int[] w, int capacity) {
        int days = 1, load = 0;
        for (int x : w) {
            load += x;
            if (load > capacity) {
                days++;
                load = x;
            }
        }
        return days;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int n = Integer.parseInt(firstMultipleInput[0]);

        int d = Integer.parseInt(firstMultipleInput[1]);

        List<Integer> weights = Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
            .map(Integer::parseInt)
            .collect(toList());

        int result = Result.minimumCapacity(weights, d);

        System.out.println(result);

        bufferedReader.close();
    }
}
