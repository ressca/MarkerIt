package pl.markerit.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class MarkerItApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(MarkerItApiApplication.class, args);
    }
}
