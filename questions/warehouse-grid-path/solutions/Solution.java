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
        int rows = grid.size(), cols = grid.get(0).length(), width = cols + 2;
        // Surround the floor with shelves so a step can never leave the grid.
        // blocked marks a cell the robot cannot step into: a shelf, or a cell it has already reached.
        boolean[] blocked = new boolean[(rows + 2) * width];
        Arrays.fill(blocked, true);
        int start = -1, end = -1;
        for (int r = 0; r < rows; r++) {
            String row = grid.get(r);
            for (int c = 0; c < cols; c++) {
                int cell = (r + 1) * width + c + 1;
                char ch = row.charAt(c);
                blocked[cell] = ch == '#';
                if (ch == 'S') start = cell;
                else if (ch == 'E') end = cell;
            }
        }
        int[] dist = new int[blocked.length];
        int[] queue = new int[rows * cols];
        int[] moves = {-width, width, -1, 1};
        int head = 0, tail = 0;
        queue[tail++] = start;
        blocked[start] = true;
        while (head < tail) {  // breadth-first: cells leave the queue in order of distance
            int cell = queue[head++];
            for (int move : moves) {
                int next = cell + move;
                if (!blocked[next]) {
                    dist[next] = dist[cell] + 1;
                    if (next == end) return dist[next];
                    blocked[next] = true;
                    queue[tail++] = next;
                }
            }
        }
        return -1;
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
