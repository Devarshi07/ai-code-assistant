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
        // Write your code here
        return 0;
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
