import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'findDuplicateAndMissing' function below.
     *
     * The function is expected to return an INTEGER_ARRAY.
     * The function accepts INTEGER_ARRAY scans as parameter.
     */

    public static List<Integer> findDuplicateAndMissing(List<Integer> scans) {
        int n = scans.size();
        // XOR of the log and of 1..n leaves duplicate ^ missing.
        int both = 0;
        for (int i = 0; i < n; i++) both ^= scans.get(i) ^ (i + 1);
        // Split every number on one bit where the two differ; each side isolates one of them.
        int bit = both & -both;
        int a = 0;
        for (int i = 0; i < n; i++) {
            int v = scans.get(i);
            if ((v & bit) != 0) a ^= v;
            if (((i + 1) & bit) != 0) a ^= i + 1;
        }
        int b = both ^ a;
        for (int v : scans) {
            if (v == a) return Arrays.asList(a, b);
        }
        return Arrays.asList(b, a);
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        int n = Integer.parseInt(bufferedReader.readLine().trim());

        List<Integer> scans = Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
            .map(Integer::parseInt)
            .collect(toList());

        List<Integer> result = Result.findDuplicateAndMissing(scans);

        System.out.println(
            result.stream()
                .map(Object::toString)
                .collect(joining(" "))
        );

        bufferedReader.close();
    }
}
