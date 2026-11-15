import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'badgeScores' function below.
     *
     * The function is expected to return an INTEGER_ARRAY.
     * The function accepts following parameters:
     *  1. INTEGER_ARRAY scores
     *  2. INTEGER m
     *  3. INTEGER g
     *  4. INTEGER t
     */

    public static List<Integer> badgeScores(List<Integer> scores, int m, int g, int t) {
        List<Integer> result = new ArrayList<>(scores.size());
        for (int s : scores) {
            long c = ((long) s + m - 1) / m * m;
            result.add(s >= t && c - s < g ? (int) c : s);
        }
        return result;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int n = Integer.parseInt(firstMultipleInput[0]);

        int m = Integer.parseInt(firstMultipleInput[1]);

        int g = Integer.parseInt(firstMultipleInput[2]);

        int t = Integer.parseInt(firstMultipleInput[3]);

        List<Integer> scores = Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
            .map(Integer::parseInt)
            .collect(toList());

        List<Integer> result = Result.badgeScores(scores, m, g, t);

        System.out.println(
            result.stream()
                .map(Object::toString)
                .collect(joining("\n"))
        );

        bufferedReader.close();
    }
}
