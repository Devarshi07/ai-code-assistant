import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'longestClimb' function below.
     *
     * The function is expected to return an INTEGER_ARRAY.
     * The function accepts INTEGER_ARRAY alt as parameter.
     */

    public static List<Integer> longestClimb(List<Integer> alt) {
        final long MOD = 1_000_000_007L;
        // A Fenwick tree over value ranks: node i stores the longest climb ending at a
        // value whose rank lies in its range, and how many such climbs there are.
        int[] values = alt.stream().mapToInt(Integer::intValue).toArray();
        int[] distinct = Arrays.stream(values).sorted().distinct().toArray();
        int size = distinct.length;
        int[] treeLen = new int[size + 1];
        long[] treeCnt = new long[size + 1];
        for (int v : values) {
            int r = Arrays.binarySearch(distinct, v) + 1;
            int best = 0;
            long ways = 1;
            for (int i = r - 1; i > 0; i &= i - 1) {
                if (treeLen[i] > best) { best = treeLen[i]; ways = treeCnt[i]; }
                else if (treeLen[i] == best) ways += treeCnt[i];
            }
            best++;
            ways %= MOD;
            for (int i = r; i <= size; i += i & -i) {
                if (treeLen[i] < best) { treeLen[i] = best; treeCnt[i] = ways; }
                else if (treeLen[i] == best) treeCnt[i] = (treeCnt[i] + ways) % MOD;
            }
        }
        int best = 0;
        long ways = 0;
        for (int i = size; i > 0; i &= i - 1) {
            if (treeLen[i] > best) { best = treeLen[i]; ways = treeCnt[i]; }
            else if (treeLen[i] == best) ways += treeCnt[i];
        }
        return Arrays.asList(best, (int) (ways % MOD));
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));
        BufferedWriter bufferedWriter = new BufferedWriter(new OutputStreamWriter(System.out));

        int n = Integer.parseInt(bufferedReader.readLine().trim());

        List<Integer> alt = Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
            .map(Integer::parseInt)
            .collect(toList());

        List<Integer> result = Result.longestClimb(alt);

        bufferedWriter.write(
            result.stream()
                .map(Object::toString)
                .collect(joining(" "))
            + "\n"
        );

        bufferedReader.close();
        bufferedWriter.close();
    }
}
