import java.io.*;
import java.math.*;
import java.util.*;
import java.util.stream.*;
import static java.util.stream.Collectors.toList;

class Result {

    /*
     * Complete the 'shortestPath' function below.
     *
     * The function is expected to return an INTEGER.
     * The function accepts STRING_ARRAY grid as parameter.
     */

    public static int shortestPath(List<String> grid) {
        // Write your code here
        return 0;
    }

}

public class Solution {
    public static void main(String[] args) throws IOException {
        BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(System.in));

        String[] firstMultipleInput = bufferedReader.readLine().replaceAll("\\s+$", "").split(" ");

        int rows = Integer.parseInt(firstMultipleInput[0]);

        int cols = Integer.parseInt(firstMultipleInput[1]);

        List<String> grid = IntStream.range(0, rows).mapToObj(i -> {
            try {
                return bufferedReader.readLine().trim();
            } catch (IOException ex) {
                throw new RuntimeException(ex);
            }
        })
            .collect(toList());

        int result = Result.shortestPath(grid);

        System.out.println(result);

        bufferedReader.close();
    }
}
