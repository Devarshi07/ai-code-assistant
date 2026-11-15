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
        // Write your code here
        return new ArrayList<>();
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
