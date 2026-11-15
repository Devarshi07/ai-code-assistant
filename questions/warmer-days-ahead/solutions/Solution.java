import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.joining;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'daysUntilWarmer' function below.
     *
     * The function is expected to return an INTEGER_ARRAY.
     * The function accepts INTEGER_ARRAY temperatures as parameter.
     */

    public static List<Integer> daysUntilWarmer(List<Integer> temperatures) {
        int n = temperatures.size();
        int[] t = new int[n];
        for (int i = 0; i < n; i++) t[i] = temperatures.get(i);
        int[] answer = new int[n];
        // Days still waiting for a warmer reading. Their readings never rise from
        // the bottom of the stack to the top, so a new reading settles them from the top.
        int[] waiting = new int[n];
        int top = 0;
        for (int i = 0; i < n; i++) {
            while (top > 0 && t[waiting[top - 1]] < t[i]) {
                int j = waiting[--top];
                answer[j] = i - j;
            }
            waiting[top++] = i;
        }
        List<Integer> result = new ArrayList<>(n);
        for (int x : answer) result.add(x);
        return result;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        int n = Integer.parseInt(bufferedReader.readLine().trim());

        List<Integer> temperatures = Stream.of(bufferedReader.readLine().replaceAll("\\s+$", "").split(" "))
            .map(Integer::parseInt)
            .collect(toList());

        List<Integer> result = Result.daysUntilWarmer(temperatures);

        System.out.println(
            result.stream()
                .map(Object::toString)
                .collect(joining(" "))
        );

        bufferedReader.close();
    }
}
