import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'countPairs' function below.
     *
     * The function is expected to return a LONG_INTEGER.
     * The function accepts following parameters:
     *  1. INTEGER_ARRAY arr
     *  2. INTEGER k
     */

    public static long countPairs(List<Integer> arr, int k) {
        HashMap<Long, Long> counts = new HashMap<>();
        for (int value : arr) counts.merge((long) value, 1L, Long::sum);
        long pairs = 0;
        for (Map.Entry<Long, Long> entry : counts.entrySet()) {
            long c = entry.getValue();
            if (k == 0) pairs += c * (c - 1) / 2;
            else pairs += c * counts.getOrDefault(entry.getKey() + k, 0L);
        }
        return pairs;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int n = Integer.parseInt(firstMultipleInput[0]);

        int k = Integer.parseInt(firstMultipleInput[1]);

        List<Integer> arr = Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
            .map(Integer::parseInt)
            .collect(toList());

        long result = Result.countPairs(arr, k);

        System.out.println(result);

        bufferedReader.close();
    }
}
