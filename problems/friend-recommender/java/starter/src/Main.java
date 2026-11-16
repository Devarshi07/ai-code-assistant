import campfire.Loader;
import campfire.Recommender;
import campfire.Report;
import campfire.SocialGraph;
import java.io.IOException;
import java.util.List;

/** Prints a support-desk view of the sample Campfire network. */
public class Main {
    public static void main(String[] args) throws IOException {
        SocialGraph graph = Loader.loadSample();
        System.out.println("Campfire sample network: " + Report.networkSummary(graph));
        System.out.println();
        for (String userId : List.of("alice", "bob", "judy", "peggy")) {
            System.out.println(Report.friendList(graph, userId));
        }
        System.out.println();
        System.out.println(Report.profileCard(graph, "erin", "alice"));
        System.out.println();
        for (String userId : List.of("alice", "frank", "olivia")) {
            try {
                System.out.println(Report.suggestionLines(graph, userId, Recommender.recommend(graph, userId, 3)));
            } catch (UnsupportedOperationException e) {
                System.out.println("People " + graph.user(userId).firstName() + " may know: " + e.getMessage());
            }
        }
    }
}
